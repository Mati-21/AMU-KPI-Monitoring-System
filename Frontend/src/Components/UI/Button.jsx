const Button = ({ children, variant = 'default', size = 'default', className = '', ...props }) => {
  let base = 'inline-flex items-center justify-center rounded-md font-medium transition px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed ';

  // 🎨 Variants
  let variantStyle = '';
  if (variant === 'destructive') {
    variantStyle = 'bg-red-500 text-white hover:bg-red-600';
  } else if (variant === 'outline') {
    variantStyle = 'border border-gray-300 hover:bg-gray-100';
  } else {
    variantStyle = 'bg-blue-500 text-white hover:bg-blue-600';
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
