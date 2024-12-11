import amqp from "amqplib";
import dotenv from "dotenv";

dotenv.config();

const LOCAL_RABBITMQ_URL = process.env.rabbitmq_url || "amqp://localhost"; 
if(!LOCAL_RABBITMQ_URL) {
  throw new Error("RabbitMQ URL is not provided");
}

export async function createChannel() {
    const connection = await amqp.connect(LOCAL_RABBITMQ_URL);
    const channel = await connection.createChannel();
    return { connection, channel };
}

export const fetchDataFromQueue = async (queue: string, message: any): Promise<any> => {
    const { channel, connection } = await createChannel();
    const replyQueue = await channel.assertQueue("", { exclusive: true });
    const correlationId = generateUuid();

    console.log(`Sending message to queue: ${queue}`);
    console.log(`Message: ${JSON.stringify(message)}`);
    console.log(`Correlation ID: ${correlationId}`);

    return new Promise((resolve, reject) => {
        channel.consume(
            replyQueue.queue,
            (msg) => {
                if (msg && msg.properties.correlationId === correlationId) {
                    const response = JSON.parse(msg.content.toString());
                    console.log(`Received response from ${queue}:`, response);
                    resolve(response);
                    connection.close();
                } else if (!msg) {
                    reject(new Error("Received a null message from RabbitMQ"));
                }
            },
            { noAck: true }
        );

        channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
            replyTo: replyQueue.queue,
            correlationId,
        });
    });
};


function generateUuid() {
    return Math.random().toString() + Math.random().toString() + Math.random().toString();
}
