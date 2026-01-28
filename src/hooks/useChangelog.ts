import { useState, useEffect } from 'react';

export function useChangelog() {
  const [changelog, setChangelog] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/changelog.md')
      .then((res) => res.text())
      .then((text) => {
        setChangelog(text);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return { changelog, loading };
}
