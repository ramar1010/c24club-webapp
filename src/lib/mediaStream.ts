export const playVideoElement = (video: HTMLVideoElement | null) => {
  if (!video) return;

  const attemptPlay = () => {
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  };

  video.addEventListener("loadedmetadata", attemptPlay, { once: true });
  attemptPlay();
};

export const attachStreamToVideo = (
  video: HTMLVideoElement | null,
  stream: MediaStream | null,
  options?: { muted?: boolean },
) => {
  if (!video || !stream) return;

  if (typeof options?.muted === "boolean") {
    video.muted = options.muted;
  }

  if (video.srcObject !== stream) {
    video.srcObject = stream;
  }

  playVideoElement(video);
};

export const getTrackEventStream = (
  event: RTCTrackEvent,
  existingStream: MediaStream | null = null,
) => {
  if (event.streams[0]) {
    return event.streams[0];
  }

  const fallbackStream = existingStream ?? new MediaStream();
  const alreadyAdded = fallbackStream
    .getTracks()
    .some((track) => track.id === event.track.id);

  if (!alreadyAdded) {
    fallbackStream.addTrack(event.track);
  }

  return fallbackStream;
};
