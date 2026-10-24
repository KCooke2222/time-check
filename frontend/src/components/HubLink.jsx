import { IoClose } from "react-icons/io5";

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";
// Opened from the home screen there is no browser chrome, so offer a way back to
// the view hub that serves this app (its root on the same origin).
const STANDALONE =
  window.matchMedia?.("(display-mode: standalone)").matches ||
  window.navigator.standalone ||
  /[?&]sa=1/.test(window.location.search);

function HubLink({ className = "" }) {
  if (!STANDALONE || DEMO_MODE) return null;
  return (
    <a
      href="/"
      title="Hub"
      aria-label="Hub"
      className={`w-9 h-9 rounded-full flex items-center justify-center transition ${className}`}
    >
      <IoClose size={20} />
    </a>
  );
}

export default HubLink;
