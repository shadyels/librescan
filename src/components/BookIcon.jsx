function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function stringToColor(str) {
  const hue = hashString(str) % 360;
  return `hsl(${hue}, 45%, 45%)`;
}

function stringToColorDark(str) {
  const hue = hashString(str) % 360;
  return `hsl(${hue}, 45%, 32%)`;
}

function BookIcon({ title = "Unknown Book", size = 120 }) {
  const mainColor = stringToColor(title);
  const spineColor = stringToColorDark(title);
  const width = size;
  const height = size * 1.3;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 130"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mx-auto"
    >
      <rect x="0" y="5" width="15" height="120" rx="2" fill={spineColor} />
      <rect x="10" y="0" width="90" height="130" rx="3" fill={mainColor} />
      <line x1="95" y1="10" x2="95" y2="120" stroke="white" strokeWidth="0.5" opacity="0.2" />
      <line x1="92" y1="10" x2="92" y2="120" stroke="white" strokeWidth="0.5" opacity="0.2" />
      <line x1="89" y1="10" x2="95" y2="120" stroke="white" strokeWidth="0.5" opacity="0.2" />
      <path d="M 55 0 L 50 0 L 50 15 L 52.5 12 L 55 15 Z" fill="white" opacity="0.4" />
    </svg>
  );
}

export default BookIcon;
