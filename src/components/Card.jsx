import './Card.css';

export function Card({ title, headerAction, className = '', children, ...rest }) {
  return (
    <section className={`app-card ${className}`.trim()} {...rest}>
      {(title || headerAction) && (
        <div className="app-card-header">
          {title && <h2 className="app-card-title">{title}</h2>}
          {headerAction}
        </div>
      )}
      {children}
    </section>
  );
}
