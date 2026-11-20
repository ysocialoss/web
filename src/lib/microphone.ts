export function microphoneErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotFoundError":
        return "No microphone found. Connect a microphone and try again.";
      case "NotAllowedError":
      case "SecurityError":
        return "Microphone access was denied. Allow it in your browser to record.";
      case "NotReadableError":
        return "Couldn’t use the microphone. Check that it’s available and try again.";
    }
  }
  return "Couldn’t start recording. Check your microphone and try again.";
}
