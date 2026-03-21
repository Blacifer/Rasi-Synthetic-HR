import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function MarketplacePage() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/dashboard/connectors', { replace: true });
  }, [navigate]);
  return null;
}
