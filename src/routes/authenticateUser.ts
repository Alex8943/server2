import jwt, { JwtPayload } from "jsonwebtoken";

export default function verifyUser(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization token is missing or malformed" });
    }

    const token = authHeader.split(" ")[1]; // Extract the token

    const decoded = jwt.verify(token, "secret") as JwtPayload;
    if(!decoded.user || !decoded.user.id) {
      return res.status(400).send({ error: "User ID is missing in the token" });
    }
    console.log("Decoded Token:", decoded);

    next();
  } catch (error: any) {
    console.error("JWT verification error:", error);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
