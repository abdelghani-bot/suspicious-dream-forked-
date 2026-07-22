export function useEssentialAlerts(products) {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!products || products.length === 0) return;

    const grouped = {};
    products
      .filter((p) => p.is_essential)
      .forEach((p) => {
        const key = `${p.active_ingredient} ${p.concentration}`;
        if (!grouped[key]) {
          grouped[key] = { totalStock: 0, minStock: p.min_stock || 0 };
        }
        grouped[key].totalStock += p.stock || 0;
      });

    const newAlerts = [];
    Object.entries(grouped).forEach(([name, data]) => {
      if (data.totalStock === 0) {
        newAlerts.push({ type: "danger", name });
      } else if (data.totalStock <= data.minStock) {
        newAlerts.push({ type: "warning", name, stock: data.totalStock });
      }
    });

    setAlerts(newAlerts);
  }, [products]);

  return alerts;
}
