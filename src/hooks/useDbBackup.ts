import { useDatabase } from "./useDatabase";

export function useDbBackup() {
  const { exportDatabase, importDatabase } = useDatabase();

  const exportDbToFile = async (filename = "basketball_erp_backup.db") => {
    const data: Uint8Array = await exportDatabase();

    // Create a copy backed by a normal ArrayBuffer
    const copy = new Uint8Array(data); // copies bytes into a new ArrayBuffer

    const blob = new Blob([copy], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  };

  const importDbFromFilePicker = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".db,.sqlite,.sqlite3,.sql";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const ab = await file.arrayBuffer();
      await importDatabase(new Uint8Array(ab));
    };
    input.click();
  };

  return { exportDbToFile, importDbFromFilePicker };
}
