function InputMoneda({ value, onChange, placeholder, required, className }) {
  // Formatea un número con puntos de miles (estilo colombiano)
  const formatear = (valor) => {
    if (!valor) return '';
    const soloNumeros = valor.toString().replace(/\D/g, '');
    return soloNumeros.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const handleChange = (e) => {
    const soloNumeros = e.target.value.replace(/\D/g, '');
    onChange(soloNumeros);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={formatear(value)}
      onChange={handleChange}
      placeholder={placeholder}
      required={required}
      className={className}
    />
  );
}

export default InputMoneda;