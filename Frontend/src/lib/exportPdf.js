const sanitizeFileName = (name) => {
  const safe = String(name || 'dashboard')
    .replace(/[^a-z0-9\-_ ]/gi, '')
    .trim()
    .replace(/\s+/g, '_');
  return safe || 'dashboard';
};

export const getSafePdfFilename = (name) => `${sanitizeFileName(name)}.pdf`;

const collectStyleTags = () => {
  const nodes = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'));
  return nodes.map((node) => node.outerHTML).join('\n');
};

const waitForImages = async (doc) => {
  const images = Array.from(doc.images || []);
  if (!images.length) return;

  await Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
          })
    )
  );
};

const createPrintFrame = () => {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  return iframe;
};

export const exportElementToPdf = async ({ element, filename }) => {
  if (!element) throw new Error('Missing element to export');

  // Browser-native print-to-PDF (works with modern CSS colors like oklch()).
  const outputName = getSafePdfFilename(filename);
  const iframe = createPrintFrame();
  document.body.appendChild(iframe);
  const printWindow = iframe.contentWindow;
  const printDocument = iframe.contentDocument;
  if (!printWindow || !printDocument) {
    iframe.remove();
    throw new Error('Failed to initialize PDF export frame.');
  }

  const clone = element.cloneNode(true);
  clone.style.overflow = 'visible';
  clone.style.height = 'auto';
  clone.style.maxHeight = 'none';

  const styles = collectStyleTags();
  const htmlClass = document.documentElement.className || '';

  // NOTE: Avoid copying scripts; we only need static HTML + CSS.
  printDocument.open();
  printDocument.write(`<!doctype html>
<html class="${htmlClass}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${outputName}</title>
    ${styles}
    <style>
      @page { size: A4; margin: 12mm; }
      html, body { height: auto !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      /* Ensure the export isn't clipped by app shell layouts */
      .__pdf_root { overflow: visible !important; height: auto !important; max-height: none !important; }
    </style>
  </head>
  <body>
    <div class="__pdf_root"></div>
  </body>
</html>`);
  printDocument.close();

  const mount = printDocument.querySelector('.__pdf_root');
  if (!mount) throw new Error('Failed to prepare PDF document');
  mount.appendChild(clone);

  await new Promise((resolve) => printWindow.requestAnimationFrame(() => resolve()));
  await waitForImages(printDocument);

  await new Promise((resolve) => {
    const done = () => resolve();
    // Some browsers don't reliably fire afterprint; still proceed.
    const timeoutId = setTimeout(done, 2000);
    printWindow.addEventListener(
      'afterprint',
      () => {
        clearTimeout(timeoutId);
        done();
      },
      { once: true }
    );
    printWindow.focus();
    printWindow.print();
  });

  // Cleanup.
  setTimeout(() => iframe.remove(), 500);
};
