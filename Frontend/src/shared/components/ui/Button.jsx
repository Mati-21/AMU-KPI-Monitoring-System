const Button = ({ children, variant = 'default', size = 'default', className = '', ...props }) => {
  let base = 'inline-flex items-center justify-center rounded-md font-medium transition px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed ';

  // 🎨 Variants
  let variantStyle = '';
  if (variant === 'destructive') {
    variantStyle = 'bg-destructive text-destructive-foreground hover:bg-destructive/90';
  } else if (variant === 'outline') {
    variantStyle = 'border border-border bg-transparent hover:bg-accent/50 text-foreground';
  } else if (variant === 'secondary') {
    variantStyle = 'bg-secondary text-secondary-foreground hover:bg-secondary/80';
  } else if (variant === 'ghost') {
    variantStyle = 'bg-transparent hover:bg-accent/50 text-foreground';
  } else {
    variantStyle = 'bg-primary text-primary-foreground hover:bg-primary/90';
  }

  // 📏 Sizes
  let sizeStyle = '';
  if (size === 'sm') {
    sizeStyle = 'text-sm px-3 py-1';
  } else if (size === 'lg') {
    sizeStyle = 'text-lg px-6 py-2';
  }

  return (
    <button className={`${base} ${variantStyle} ${sizeStyle} ${className}`} {...props}>
      {children}
    </button>
  );
};

export default Button;
