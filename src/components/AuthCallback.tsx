import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session) {
          navigate('/dashboard');
        } else {
          navigate('/');
        }
      })
      .catch((error) => {
        console.error('Error handling auth callback:', error);
        navigate('/');
      });
  }, [navigate]);

  return (
    <div className="page page-centered">
      <div className="spinner" />
    </div>
  );
}
