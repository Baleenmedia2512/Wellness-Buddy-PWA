// Crop a square region from a base64 image, supporting rotation + flip.
export const getCroppedImg = (imageSrc, pixelCrop, rotation = 0, flip = { h: false, v: false }) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = Math.max(img.width, img.height) * 2;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.translate(size / 2, size / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(flip.h ? -1 : 1, flip.v ? -1 : 1);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      const out = document.createElement('canvas');
      const outSize = Math.min(pixelCrop.width, pixelCrop.height);
      out.width = outSize;
      out.height = outSize;
      out.getContext('2d').drawImage(
        canvas,
        pixelCrop.x + (size / 2 - img.width / 2),
        pixelCrop.y + (size / 2 - img.height / 2),
        pixelCrop.width, pixelCrop.height,
        0, 0, outSize, outSize,
      );
      resolve(out.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
