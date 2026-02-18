import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { IncomingForm, File as FormidableFile } from "formidable";
import fs from "fs";
import path from "path";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = {
  api: { bodyParser: false },
};

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function uploadToS3(
  filePath: string,
  fileName: string,
  mimeType: string,
  folder: string
): Promise<string> {
  const fileBuffer = fs.readFileSync(filePath);
  const key = `${folder}/${Date.now()}-${fileName}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
    })
  );

  return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify admin secret
  const adminSecret = req.headers["x-admin-secret"];
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const form = new IncomingForm({ multiples: true, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: "Form parse error", details: err.message });
    }

    try {
      const id = Array.isArray(fields.id) ? fields.id[0] : fields.id;
      const name = Array.isArray(fields.name) ? fields.name[0] : fields.name;
      const price = parseFloat(Array.isArray(fields.price) ? fields.price[0] : fields.price ?? "0");
      const category = Array.isArray(fields.category) ? fields.category[0] : fields.category;
      const description = Array.isArray(fields.description) ? fields.description[0] : fields.description;

      if (!id || !name || !category) {
        return res.status(400).json({ error: "id, name, and category are required" });
      }

      // Upload GLB model
      const glbFile = (Array.isArray(files.glb) ? files.glb[0] : files.glb) as FormidableFile | undefined;
      if (!glbFile) return res.status(400).json({ error: "GLB file is required" });

      const glbUrl = await uploadToS3(
        glbFile.filepath,
        glbFile.originalFilename ?? "model.glb",
        "model/gltf-binary",
        "models"
      );

      // Upload thumbnail
      let thumbnailUrl = "";
      const thumbFile = (Array.isArray(files.thumbnail) ? files.thumbnail[0] : files.thumbnail) as FormidableFile | undefined;
      if (thumbFile) {
        thumbnailUrl = await uploadToS3(
          thumbFile.filepath,
          thumbFile.originalFilename ?? "thumbnail.jpg",
          thumbFile.mimetype ?? "image/jpeg",
          "thumbnails"
        );
      }

      // Upload additional images
      const imageUrls: string[] = [];
      const imageFiles = Array.isArray(files.images) ? files.images : files.images ? [files.images] : [];
      for (const imgFile of imageFiles as FormidableFile[]) {
        const url = await uploadToS3(
          imgFile.filepath,
          imgFile.originalFilename ?? "image.jpg",
          imgFile.mimetype ?? "image/jpeg",
          "images"
        );
        imageUrls.push(url);
      }

      // Insert into Supabase
      const { data, error } = await supabase.from("models").insert([
        {
          id,
          name,
          price,
          category,
          description: description ?? "",
          thumbnail: thumbnailUrl,
          images: imageUrls,
          glb: glbUrl,
          created_at: new Date().toISOString(),
        },
      ]).select();

      if (error) {
        return res.status(500).json({ error: "Supabase insert failed", details: error.message });
      }

      return res.status(200).json({
        success: true,
        message: `Model "${name}" uploaded successfully!`,
        model: data[0],
        urls: { glb: glbUrl, thumbnail: thumbnailUrl, images: imageUrls },
      });
    } catch (uploadError: any) {
      return res.status(500).json({ error: "Upload failed", details: uploadError.message });
    }
  });
}
