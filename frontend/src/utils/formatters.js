export const formatSize = (bytes) => {
  if (bytes === 0 || bytes === null || bytes === undefined) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatDate = (dateString) => {
  if (!dateString) return '—';
  // Handle space separator if SQLite returns space: "2026-09-14 00:53:11" -> "2026-09-14T00:53:11"
  const safeStr = typeof dateString === 'string' ? dateString.replace(' ', 'T') : dateString;
  const date = new Date(safeStr);
  if (isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

export const formatDateTime = (dateString) => {
  if (!dateString) return '';
  const safeStr = typeof dateString === 'string' ? dateString.replace(' ', 'T') : dateString;
  const date = new Date(safeStr);
  if (isNaN(date.getTime())) return '';

  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};
