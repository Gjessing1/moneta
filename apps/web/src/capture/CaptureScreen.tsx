import { CameraIcon, UploadIcon } from '../icons';

// The controls are drawn where they will live, but saving captures is not built
// yet, so they are disabled and say so rather than failing silently.
export function CaptureScreen() {
  return (
    <div className="screen">
      <header className="screen-header">
        <h1 className="screen-title">Capture</h1>
      </header>
      <div className="capture">
        <button type="button" className="capture__camera" disabled aria-describedby="capture-note">
          <span className="capture__lens">
            <CameraIcon size={40} strokeWidth={1.7} />
          </span>
          <span className="capture__camera-title">Photograph a receipt</span>
          <span className="capture__camera-hint">Opens the rear camera</span>
        </button>
        <button type="button" className="row-button" disabled aria-describedby="capture-note">
          <UploadIcon size={22} strokeWidth={1.9} />
          <span className="row-button__text">
            <span className="row-button__title">Upload files</span>
            <span className="row-button__hint">PDFs or images, one or many</span>
          </span>
        </button>
        <p id="capture-note" className="note">
          Saving photos and files is not ready yet. It is the next part being built.
        </p>
      </div>
    </div>
  );
}
