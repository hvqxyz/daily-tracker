import './Button.css';

/**
 * Generic application button.
 *
 * Variants: primary (filled accent), secondary (outlined accent),
 * subtle (ghost), danger (outlined critical).
 * Sizes: default, small, icon (square, for icon-only buttons).
 */
export function Button({
  children,
  variant = 'primary',
  size = 'default',
  type = 'button',
  className = '',
  ...rest
}) {
  const classes = ['app-button', `app-button-${variant}`, `app-button-size-${size}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
