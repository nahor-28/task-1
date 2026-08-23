export function AttachmentViewer({ url }) {
  if (!url) return null;
  const isPdf = url.toLowerCase().endsWith('.pdf');

  return (
    <div>
      <a href={url} target="_blank" rel="noreferrer" className="link link-primary text-sm">
        {isPdf ? 'Open attachment' : 'Download attachment'}
      </a>
      {isPdf && (
        <iframe
          src={url}
          title="Attachment preview"
          className="mt-2 w-full h-96 border border-base-300 rounded-box"
        />
      )}
    </div>
  );
}
