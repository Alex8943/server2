import express from "express";
import sequelize from "../other_services/sequelizeConnection";
import { QueryTypes } from "sequelize";
import { fetchDataFromQueue } from "../other_services/rabbitMQ";
import verifyUser from "./authenticateUser";

const router = express.Router();

// Create a new review
router.post("/review", verifyUser, async (req, res) => {
    try {
        const result = await createReview(req.body);
        res.status(200).send(result);
    } catch (err) {
        console.error("Error creating review:", err);
        res.status(500).send({ error: "Something went wrong while creating the review" });
    }
});

export async function createReview(values: any) {
    const t = await sequelize.transaction(); // Begin transaction

    try {
        // Step 1: Insert the basic review data into the database
        const [reviewId] = await sequelize.query(
            'INSERT INTO `reviews` (`id`, `media_fk`, `title`, `description`, `platform_fk`, `user_fk`, `createdAt`, `updatedAt`, `isBlocked`) VALUES (DEFAULT, ?, ?, ?, ?, ?, NOW(), NOW(), FALSE);',
            {
                replacements: [
                    values.media_fk,
                    values.title,
                    values.description,
                    values.platform_fk,
                    values.user_fk,
                ],
                type: QueryTypes.INSERT,
                transaction: t,
                  
            }
        );

        if (!values.user_fk) {
            throw new Error("User ID (user_fk) is required in the payload");
          }


        console.log("Basic review created with ID:", reviewId);

        // Step 2: Fetch user, media, and genres from RabbitMQ
        const [user, media, reviewGenres] = await Promise.all([
            fetchDataFromQueue("user-service", { userId: values.user_fk }),
            fetchDataFromQueue("media-service", { mediaId: values.media_fk }),
            fetchDataFromQueue("review-genres-service", { reviewId }), // Fetch genres from database1
        ]);

        console.log("Fetched user:", user);
        console.log("Fetched media:", media);
        console.log("Fetched review genres:", reviewGenres);

        // Step 3: Validate fetched data
        if (!user || user.error) {
            throw new Error(`User with ID ${values.user_fk} not found.`);
        }
        if (!media || media.error) {
            throw new Error(`Media with ID ${values.media_fk} not found.`);
        }
        if (!reviewGenres || reviewGenres.length === 0) {
            console.warn(`No genres found for review ID ${reviewId}.`);
        }

        await t.commit(); // Commit transaction
        console.log("Review created successfully with ID:", reviewId);

        return {
            reviewId,
            user,
            media,
            genres: reviewGenres, // Enrich the response with genres
        };
    } catch (error) {
        await t.rollback(); // Rollback transaction on error
        console.error("Error during review creation:", error);
        throw error;
    }
}

export default router;
