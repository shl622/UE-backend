import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import * as Joi from "joi"
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { User } from './users/entities/user.entity';
import { JwtModule } from './jwt/jwt.module';
import { Verification } from './users/entities/verfication.entity';
import { EmailModule } from './email/email.module';
import { Restaurant } from './restaurants/entities/restaurant.entity';
import { Category } from './restaurants/entities/category.entity';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { AuthModule } from './auth/auth.module';
import { Dish } from './restaurants/entities/dish.entity';
import { OrdersModule } from './orders/orders.module';
import { Order } from './orders/entities/order.entity';
import { OrderItem } from './orders/entities/order-item.entity';
import { CommonModule } from './common/common.module';
import { PaymentsModule } from './payments/payments.module';
import { Payment } from './payments/entities/payment.entity';
import { ScheduleModule } from '@nestjs/schedule';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === "dev" ? ".env.dev" : ".env.test",
      ignoreEnvFile: process.env.Node_ENV === "prod",
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('dev', 'prod', 'test').required(),
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.string().required(),
        DB_USERNAME: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
        DB_NAME: Joi.string().required(),
        PRIVATE_KEY: Joi.string().required(),
        MAILGUN_API_KEY: Joi.string().required(),
        MAILGUN_DOMAIN_NAME: Joi.string().required(),
        MAILGUN_FROM_EMAIL: Joi.string().required(),
        AWS_KEY: Joi.string().required(), 
        AWS_SECRET_KEY: Joi.string().required()
      })
    }),
    TypeOrmModule.forRoot({
      type: "postgres",
      host: process.env.DB_HOST,
      port: +process.env.DB_PORT,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      synchronize: process.env.NODE_ENV !== "prod",
      logging: process.env.NODE_ENV !== "prod" && process.env.NODE_ENV !== 'test',
      namingStrategy: new SnakeNamingStrategy(),
      entities: [User, Verification, Restaurant, Category, Dish, Order, OrderItem, Payment],
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      //https://docs.nestjs.com/graphql/subscriptions
      subscriptions: {
        'subscriptions-transport-ws': {
          onConnect: (connectionParams: any) => {
            return { token: connectionParams['x-jwt'] }
          }
        }
      },
      context: ({ req, connection }) => {
        const TOKEN_KEY = "x-jwt"
        return {
          token: req ? req.headers[TOKEN_KEY] : connection.context[TOKEN_KEY]
        }
      },
    }),
    ScheduleModule.forRoot(),
    JwtModule.forRoot({
      privateKey: process.env.PRIVATE_KEY
    }),
    EmailModule.forRoot({
      apiKey: process.env.MAILGUN_API_KEY,
      domain: process.env.MAILGUN_DOMAIN_NAME,
      fromEmail: process.env.MAILGUN_FROM_EMAIL,
    }),
    UsersModule,
    RestaurantsModule,
    AuthModule,
    OrdersModule,
    CommonModule,
    PaymentsModule,
    UploadsModule
  ],
  controllers: [],
  providers: [],
})

// export class AppModule implements NestModule {
//   configure(consumer: MiddlewareConsumer) {
//     consumer.apply(JwtMiddleware).forRoutes({
//       path: "/graphql",
//       method: RequestMethod.POST
//     })
//   }
// }
export class AppModule { }