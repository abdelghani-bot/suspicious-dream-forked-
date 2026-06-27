export const Toast = ({ msg, type }) => (
  <div
    style={{
      position: "fixed",
      top: 20,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 9999,
      background:
        type === "error" ? "#3a0a0a" : type === "warn" ? "#3a2a00" : "#0a2a18",
      border: `1px solid ${
        type === "error" ? "#7a2020" : type === "warn" ? "#7a5a00" : "#1a6a46"
      }`,
      borderRadius: 12,
      padding: "13px 28px",
      color:
        type === "error" ? "#ff8888" : type === "warn" ? "#ffcc44" : "#44dd88",
      fontSize: 15,
      fontWeight: 700,
      boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
      whiteSpace: "nowrap",
      pointerEvents: "none",
    }}
  >
    {msg}
  </div>
);

