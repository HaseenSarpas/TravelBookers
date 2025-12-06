import { sql } from "../config/db.js";

// Helper function to ensure Cloudinary URLs are HTTPS and properly formatted
const ensureHttpsUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  
  // Trim whitespace
  url = url.trim();
  
  // If it's already a full HTTPS URL, return as-is
  if (url.startsWith("https://")) {
    return url;
  }
  
  // Convert HTTP Cloudinary URLs to HTTPS
  if (url.startsWith("http://res.cloudinary.com") || url.startsWith("http://cloudinary.com")) {
    return url.replace("http://", "https://");
  }
  
  // If it starts with //, prepend https:
  if (url.startsWith("//")) {
    return "https:" + url;
  }
  
  // If it's a Cloudinary URL without protocol, add https
  if (url.startsWith("res.cloudinary.com")) {
    return "https://" + url;
  }
  
  // Return as-is for other cases (might be a relative URL or different domain)
  return url;
};

// Helper function to normalize image data
const normalizeImage = (image) => {
  return {
    ...image,
    image_url: ensureHttpsUrl(image.image_url),
  };
};

// CREATE READ UPDATE and DELETE operations (CRUD)

export const getImages = async (req, res) => {
  try {
    const { vehicle_id, vehicle_ids } = req.query;

    let images;
    if (vehicle_ids) {
      const ids = vehicle_ids
        .split(",")
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => Number.isInteger(id));

      if (ids.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid vehicle_ids parameter" });
      }
      const idList = ids.join(", ");

      images = await sql`
        SELECT *
        FROM images
        WHERE vehicle_id IN (${sql.unsafe(idList)})
        ORDER BY vehicle_id ASC, image_id ASC
      `;
    } else if (vehicle_id) {
      images = await sql`
        SELECT * FROM images
        WHERE vehicle_id = ${vehicle_id}
        ORDER BY image_id ASC
      `;
    } else {
      images = await sql`
        SELECT * FROM images
        ORDER BY image_id ASC
      `;
    }

    // Normalize all image URLs to ensure HTTPS
    const normalizedImages = images.map(normalizeImage);
    
    // Log for debugging (can remove later)
    if (images.length > 0) {
      console.log("=== IMAGE URL DEBUGGING ===");
      console.log(`Total images: ${images.length}`);
      images.slice(0, 3).forEach((img, idx) => {
        console.log(`Image ${idx + 1} - Raw URL from DB:`, img.image_url);
        console.log(`Image ${idx + 1} - Normalized URL:`, normalizedImages[idx].image_url);
      });
      console.log("===========================");
    }
    
    res.status(200).json({ success: true, data: normalizedImages });
  } catch (error) {
    console.log("Error fetching images:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const getImage = async (req, res) => {
  const { id } = req.params;

  try {
    const image = await sql`
      SELECT * FROM images WHERE image_id = ${id}
    `;

    if (image.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Image not found" });
    }

    // Normalize image URL to ensure HTTPS
    res.status(200).json({ success: true, data: normalizeImage(image[0]) });
  } catch (error) {
    console.log("Error fetching image:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const createImage = async (req, res) => {
  const { vehicle_id, image_url } = req.body;

  if (!vehicle_id || !image_url) {
    return res
      .status(400)
      .json({ success: false, message: "vehicle_id and image_url are required" });
  }

  try {
    const newImage = await sql`
      INSERT INTO images (vehicle_id, image_url)
      VALUES (${vehicle_id}, ${image_url})
      RETURNING *
    `;

    // Normalize image URL to ensure HTTPS
    res.status(201).json({ success: true, data: normalizeImage(newImage[0]) });
  } catch (error) {
    if (error.code === "23503") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid vehicle_id" });
    }
    console.log("Error creating image:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const updateImage = async (req, res) => {
  const { id } = req.params;
  const { vehicle_id, image_url } = req.body;

  try {
    const currentImage = await sql`
      SELECT * FROM images WHERE image_id = ${id}
    `;

    if (currentImage.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Image not found" });
    }

    const updateVehicleId = vehicle_id !== undefined ? vehicle_id : currentImage[0].vehicle_id;
    const updateImageUrl = image_url !== undefined ? image_url : currentImage[0].image_url;

    const updatedImage = await sql`
      UPDATE images
      SET 
        vehicle_id = ${updateVehicleId},
        image_url = ${updateImageUrl}
      WHERE image_id = ${id}
      RETURNING *
    `;

    // Normalize image URL to ensure HTTPS
    res.status(200).json({ success: true, data: normalizeImage(updatedImage[0]) });
  } catch (error) {
    if (error.code === "23503") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid vehicle_id" });
    }
    console.log("Error updating image:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const deleteImage = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedImage = await sql`
      DELETE FROM images
      WHERE image_id = ${id}
      RETURNING *
    `;

    if (deletedImage.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Image not found" });
    }

    // Normalize image URL to ensure HTTPS
    res.status(200).json({ success: true, data: normalizeImage(deletedImage[0]) });
  } catch (error) {
    console.log("Error deleting image:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

