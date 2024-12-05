import express from "express";
import { Review as Reviews, User, Media, Genre, ReviewGenres } from "../other_services/model/seqModel";
import logger from "../other_services/winstonLogger";
import sequelize from "../other_services/sequelizeConnection";
import { NumberDataTypeConstructor, QueryTypes } from "sequelize";
import conn from "../db_service/db_connection"
import { RowDataPacket } from "mysql2";

const router = express.Router();

// Create a new review with genres
router.post("/review", async (req, res) => {
    try {
        const result = await createReview(req.body);
        res.status(200).send(result);
    } catch (err) {
        console.error("Error creating review: ", err);
        res.status(500).send("Something went wrong while creating the review");
    }
});

export async function createReview(values: any) {
    const t = await sequelize.transaction(); 

    try {
         const [review] = await sequelize.query(
            'INSERT INTO `review` (`id`, `media_fk`, `title`, `description`, `platform_fk`, `user_fk`, `createdAt`, `updatedAt`, `isBlocked`) VALUES (DEFAULT, ?, ?, ?, ?, ?, NOW(), NOW(), FALSE);',
            {
                replacements: [
                    values.media_fk,
                    values.title,
                    values.description,
                    values.platform_fk,
                    values.user_fk,
                ],
                type: QueryTypes.INSERT,
                transaction: t
            }
        );
        

        if (values.genre_ids && values.genre_ids.length > 0) {
            const reviewGenreRecords = values.genre_ids.map((genre_id: number) => ({
                review_fk: review,  
                genre_fk: genre_id,
            }));
            await ReviewGenres.bulkCreate(reviewGenreRecords, { transaction: t });
        }

        await t.commit(); 
        logger.info("Review created successfully");
        return { reviewId: review };

    } catch (err) {
        await t.rollback();
        logger.error("Error during review creation: ", err);
        throw err;
    }
}



export default router;
