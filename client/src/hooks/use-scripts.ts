import { useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useScripts() {
  return useQuery({
    queryKey: [api.scripts.list.path],
    queryFn: async () => {
      const res = await fetch(api.scripts.list.path);
      if (!res.ok) throw new Error("Failed to fetch scripts");
      return api.scripts.list.responses[200].parse(await res.json());
    },
  });
}

export async function downloadScript(id: number, filename: string) {
  const url = buildUrl(api.scripts.download.path, { id });
  const res = await fetch(url);
  
  if (!res.ok) {
    throw new Error("Download failed");
  }

  // The API returns the raw content string
  const content = await res.text();
  
  // Create a blob and trigger download
  const blob = new Blob([content], { type: 'text/plain' });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}
