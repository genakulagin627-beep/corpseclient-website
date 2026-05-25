const { resolveWorkuploadDownloadUrl } = require('../../lib/workupload');

async function main() {
  const fileId = process.argv[2] || 'DfDbfTtSUsz';
  const { downloadUrl } = await resolveWorkuploadDownloadUrl(
    `https://workupload.com/file/${fileId}`
  );
  console.log('OK', downloadUrl);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
