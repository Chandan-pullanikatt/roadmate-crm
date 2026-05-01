import React from 'react';

const DataTable = ({ columns, data, loading, emptyText = 'No data available' }) => {
  if (loading) {
    return (
      <div className="w-full overflow-hidden rounded-xl border border-border">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th key={col.key || col.accessor || i}>{col.label || col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4].map((i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col.key}>
                    <div className="h-4 w-2/3 shimmer rounded" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full py-16 flex flex-col items-center justify-center text-text-muted border border-dashed border-border rounded-xl bg-surface2/30">
        <div className="text-4xl mb-4 opacity-20">📂</div>
        <div className="text-sm font-semibold">{emptyText}</div>
        <p className="text-xs mt-1">Try adjusting your filters or search terms.</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={col.key || col.accessor || i}>{col.label || col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={row.id || row._id || rowIndex}>
              {columns.map((col, colIndex) => {
                const key = col.key || col.accessor;
                return (
                  <td key={key || colIndex}>
                    {col.render ? col.render(row[key], row) : row[key]}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
