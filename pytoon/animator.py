import os
import json
import random

from PIL import Image
from datetime import datetime
import numpy as np
import cv2
import copy
from moviepy.editor import ImageSequenceClip, CompositeVideoClip, CompositeAudioClip, AudioFileClip, VideoClip

from .util import read_json
from .dataloader import get_assets
from .lipsync import viseme_sequencer, upsample


class FrameSequence:
    def __init__(self):
        self.pose_files = []
        self.mouth_files = []
        self.pose_images = []
        self.mouth_images = []
        self.mouth_coords = []
        self.final_frames = []
        self.pose_changes = []


# Emotions that use the negative (downturned) viseme set
_NEGATIVE_EMOTIONS = {'sad', 'angry'}


class animate:
    """Animates a cartoon that is lip synced to provieded audio voiceover."""

    def __init__(self, audio_file: str, transcript: str = None, fps: int = 48,
                 emotion_schedule: list = None, allowed_emotions: list = None):
        """
        Args:
            audio_file: Path to audio file (.mp3 or .wav).
            transcript: Optional transcript string. Auto-generated if omitted.
            fps: Frames per second for output video.
            emotion_schedule: Optional list of (start_sec, end_sec, emotion_name) tuples.
                Any emotion from the full set may be used here regardless of
                allowed_emotions, since scheduled emotions are explicit choices.
                Supported: explain, happy, rhetorical, sad, angry, confused.
            allowed_emotions: List of emotion names the random fallback may pick
                from when no schedule entry covers a frame. Defaults to
                ['explain', 'happy', 'rhetorical'] to preserve original behaviour.
                Pass a wider list (e.g. adding 'confused') for non-news contexts.
        """
        self.audio_file = audio_file
        self.sequence = FrameSequence()
        self.assets = get_assets()
        self.fps = fps
        self.final_frames = []
        self.emotion_schedule = emotion_schedule or []
        self.allowed_emotions = allowed_emotions or ['explain', 'happy', 'rhetorical']

        # Initialize blinking rate (blink every 3 seconds)
        self.blink_rate = 3.0

        # Create sequence of mouth images
        self.viseme_sequence = viseme_sequencer(self.audio_file, transcript, self.fps)
        self.build_mouth_sequence()

        self.duration = len(self.sequence.mouth_files) / self.fps
        print(f"Num Created: {len(self.sequence.mouth_files)}")
        print(f"Duration: {self.duration}")

        self.build_pose_sequence()

        self.frame_size = self.get_frame_size()
        # Create the animation
        self.compile_animation()

    def _scheduled_emotion(self, frame_idx):
        """Return the scheduled emotion poses for a frame, or None to use random."""
        if not self.emotion_schedule:
            return None
        t = frame_idx / self.fps
        for start_sec, end_sec, emotion_name in self.emotion_schedule:
            if start_sec <= t < end_sec:
                poses = getattr(self.assets, emotion_name, None)
                if poses:
                    return poses
        return None

    def build_pose_sequence(self):
        """Creates the sequence of pose images for the video"""
        emotion = self._scheduled_emotion(0) or self.random_emotion()
        pose = random.choice(emotion)

        # Add a character pose frame for every frame of a mouth
        for i, _ in enumerate(self.sequence.mouth_files):
            if self.sequence.pose_changes[i]:
                # Change the pose at breath points, respecting the emotion schedule
                emotion = self._scheduled_emotion(i) or self.random_emotion()
                pose = random.choice(emotion)

            eyes = self.blink_manager(idx=i)
            self.sequence.pose_files.append(pose.image_files[eyes])
            self.sequence.mouth_coords.append(pose.mouth_coordinates)

        # Prepend absolute path to all pose images
        self.sequence.pose_files = [f"{os.path.dirname(__file__)}{file}" for file in self.sequence.pose_files]

        # Create mouth PIL image for every frame, with image transformations based on pose
        for i, _ in enumerate(self.sequence.mouth_files):
            transformed_image = mouth_transformation(
                mouth_file=self.sequence.mouth_files[i],
                mouth_coord=self.sequence.mouth_coords[i],
            )
            self.sequence.mouth_images.append(transformed_image)
        return

    def blink_manager(self, idx):

        BLINK_DURATION = 0.16
        SUB_BLINKS = ["middle", "shut", "middle"]

        frames_between_blinks = int(self.blink_rate * self.fps)
        frames_per_blink = int(BLINK_DURATION * self.fps)
        frames_per_sub_blink = int(frames_per_blink / len(SUB_BLINKS)) + 1

        full_cycle = frames_between_blinks + (frames_per_sub_blink * len(SUB_BLINKS))

        start_1 = frames_between_blinks
        start_2 = start_1 + frames_per_sub_blink
        start_3 = start_2 + frames_per_sub_blink
        end_3 = start_3 + frames_per_sub_blink

        if start_1 <= (idx % full_cycle) < start_2:
            eyes = "middle"

        elif start_2 <= (idx % full_cycle) < start_3:
            eyes = "shut"

        elif start_3 <= (idx % full_cycle) < end_3:
            eyes = "middle"

        else:
            eyes = "open"

        return eyes

    def _viseme_dir_at_frame(self, frame_idx):
        """Return 'negative' for sad/angry scheduled segments, 'positive' otherwise."""
        if not self.emotion_schedule:
            return 'positive'
        t = frame_idx / self.fps
        for start_sec, end_sec, emotion_name in self.emotion_schedule:
            if start_sec <= t < end_sec:
                return 'negative' if emotion_name in _NEGATIVE_EMOTIONS else 'positive'
        return 'positive'

    def build_mouth_sequence(self):
        """Generates a sequence of mouth images for video"""
        frame_idx = 0
        assets_dir = os.path.dirname(__file__)
        for word_viseme in self.viseme_sequence:
            if word_viseme.visemes:
                viseme_dir = self._viseme_dir_at_frame(frame_idx)
                base = f"{assets_dir}/assets/visemes/{viseme_dir}/"
                self.sequence.mouth_files.extend(base + f for f in word_viseme.visemes)
                pose_changes = [0] * len(word_viseme.visemes)
                if word_viseme.breath:
                    pose_changes[0] = 1
                self.sequence.pose_changes.extend(pose_changes)
                frame_idx += len(word_viseme.visemes)

    def random_emotion(self):
        """Returns poses for a randomly chosen emotion from allowed_emotions.

        Returns:
            list[Pose]: List of poses from a randomly selected allowed emotion.
        """
        available = [e for e in self.allowed_emotions if hasattr(self.assets, e)]
        if not available:
            available = list(self.assets.__dict__.keys())
        return getattr(self.assets, random.choice(available))

    def get_frame_size(self):
        pose_image = cv2.imread(self.sequence.pose_files[0])
        height, width, _ = pose_image.shape
        return (width, height)

    def compile_animation(self):
        for i, _ in enumerate(self.sequence.pose_files):
            frame = cv2.imread(self.sequence.pose_files[i], cv2.IMREAD_UNCHANGED)
            if self.sequence.mouth_files[i] is not None:
                final_frame = render_frame(
                    pose_img=frame,
                    mouth_img=self.sequence.mouth_images[i],
                    mouth_coord=self.sequence.mouth_coords[i],
                )
            else:
                final_frame = frame
            self.final_frames.append(final_frame)

    def export(self, path: str, background: VideoClip, scale: float = 0.7,
               position=("right", "bottom"), avatar_width: int = None,
               avatar_crop_height: int = None):
        animation_clip = ImageSequenceClip(self.final_frames, fps=self.fps, with_mask=True)

        if avatar_width is not None:
            new_width = avatar_width
            new_height = int(animation_clip.h * (new_width / animation_clip.w))
        else:
            new_height = int(background.size[1] * scale)
            new_width = int(animation_clip.w * (new_height / animation_clip.h))

        animation_clip = animation_clip.resize(width=new_width, height=new_height)

        if avatar_crop_height is not None:
            animation_clip = animation_clip.crop(
                x1=0, y1=0, x2=new_width, y2=avatar_crop_height
            )

        # Overlay the animation on top of the background clip
        final_clip = CompositeVideoClip(
            clips=[background, animation_clip.set_position(position)], use_bgclip=True
        )

        # Add speech audio to clip with 0.2 second delay
        audio_clip = AudioFileClip(self.audio_file)
        audio_clip = CompositeAudioClip([audio_clip.set_start(0.2)])
        final_clip = final_clip.set_audio(audio_clip)

        # Export video to .mp4
        final_clip.write_videofile(
            path, codec="libx264", audio_codec="aac", preset="ultrafast", threads=4, fps=self.fps
        )


def mouth_transformation(mouth_file, mouth_coord) -> Image:
    """Transforms mouth image with scaling, flipping, and rotation.
        This transformation is applied because, the same mouth shape images
        are used for different pose images, but the size, angle, and position
        of a mouth image will depend on which pose image is being used.

    Args:
        mouth_path (str): .png file path pointing to mouth image
        transformation (np.array): image transformation data for mouth

    Returns:
        Image: PIL Image object of mouth image with applied transformations
    """
    mouth = copy.deepcopy(Image.open(mouth_file))
    # Flip mouth horizontally if necessary
    if mouth_coord.flip_x is True:
        mouth = mouth.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    # Scale mouth image if necessary
    if mouth_coord.scale_y != 1:
        og_width, og_height = mouth.size
        new_width = int(abs(og_width * mouth_coord.scale_x))
        new_height = int(og_height * mouth_coord.scale_y)
        try:
            mouth = mouth.resize(new_width, new_height, Image.Resampling.LANCZOS)
        except:
            pass
    # Apply image rotation if necessary
    if mouth_coord.rotation != 0:
        mouth = mouth.rotate(-mouth_coord.rotation, resample=Image.Resampling.BICUBIC)
    return mouth


def bgra_to_rgba(image):
    # Swap blue and red channels
    b, g, r, a = np.rollaxis(image, axis=-1)
    return np.dstack([r, g, b, a])


def render_frame(pose_img: Image, mouth_img: Image, mouth_coord):
    pose_img = bgra_to_rgba(pose_img)  # convert to rgba
    pose_img = Image.fromarray(pose_img)
    mouth_width, mouth_height = mouth_img.size

    # Location in pose image where mouth / viseme image will be added
    paste_coordinates = (
        int(mouth_coord.x - (mouth_width / 2)),
        int(mouth_coord.y - (mouth_height / 2)),
    )

    # Paste the mouth image onto the face image at the specified coordinates
    pose_img.paste(im=mouth_img, box=paste_coordinates, mask=mouth_img)
    np_image = np.array(pose_img)

    return np_image
