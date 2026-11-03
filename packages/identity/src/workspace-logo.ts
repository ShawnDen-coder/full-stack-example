import { ORPCError } from "@orpc/server";
import sharp from "sharp";

// Only normalized, bounded raster data is persisted. Never trust the browser's MIME.
export async function normalizeWorkspaceLogo(
	value: string | null,
): Promise<string | null> {
	if (value === null) return null;
	const match = /^data:image\/(png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
		value,
	);
	if (!match || value.length > 44_000)
		throw new ORPCError("BAD_REQUEST", {
			message: "Choose a valid PNG or WebP image under 32 KiB.",
		});
	const bytes = Buffer.from(match[2] ?? "", "base64");
	if (bytes.length > 32_768 || bytes.toString("base64") !== match[2])
		throw new ORPCError("BAD_REQUEST", {
			message: "Invalid or oversized image.",
		});
	try {
		const image = sharp(bytes, {
			limitInputPixels: 256 * 256,
			animated: true,
			failOn: "warning",
		});
		const meta = await image.metadata();
		if (
			meta.format !== match[1] ||
			!meta.width ||
			!meta.height ||
			meta.width > 256 ||
			meta.height > 256 ||
			(meta.pages ?? 1) !== 1
		)
			throw new Error("Invalid image");
		const output = await image.webp({ quality: 75 }).toBuffer();
		if (output.length > 32_768) throw new Error("Image too large");
		return `data:image/webp;base64,${output.toString("base64")}`;
	} catch {
		throw new ORPCError("BAD_REQUEST", {
			message: "Choose a valid static image up to 256 × 256 pixels and 32 KiB.",
		});
	}
}
