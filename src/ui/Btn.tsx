export const Btn = ({
  const { C } = useTheme();
  children,
  onClick,
  variant = "primary",
  size = "md",
  style = {},
  disabled = false,
  icon,
}) => {
  const bg = {
    primary: "linear-gradient(135deg,#1e4fbf,#1a3d9f)",
    danger: "#3a1010",
    success: C.successBg,
    ghost: "transparent",
    secondary: "#1a2540",
  };
  const cl = {
    primary: "#8ab0ff",
    danger: C.danger,
    success: C.success,
    ghost: C.muted,
    secondary: "#8aa0cc",
  };
  const pd =
    size === "sm" ? "6px 14px" : size === "lg" ? "14px 32px" : "10px 20px";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: pd,
        background: bg[variant],
        border: `1px solid ${
          variant === "ghost"
            ? C.border
            : variant === "danger"
            ? "#5a2020"
            : variant === "success"
            ? C.successBorder
            : "#2a4a8a"
        }`,
        borderRadius: 9,
        color: cl[variant],
        fontSize: size === "sm" ? 12 : 14,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.15s",
        ...style,
      }}
    >
      {icon && <IC n={icon} s={size === "sm" ? 13 : 16} />}
      {children}
    </button>
  );
};

