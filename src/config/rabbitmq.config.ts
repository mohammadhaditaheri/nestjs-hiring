export const RabbitMQConfig = () => ({
    rabbitmq: {
        url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
        queues: {
            predictionProcessing: 'prediction.processing',
        },
        exchanges: {
            predictions: 'predictions.exchange',
        },
    },
});