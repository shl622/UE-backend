import { Field, ObjectType } from "@nestjs/graphql";
import { CoreOutput } from "src/common/dto/output.dto";
import { Restaurant } from "../entities/restaurant.entity";


@ObjectType()
export class MyRestaurantsOutput extends CoreOutput {
    @Field(type => [Restaurant], { nullable: true })
    myRestaurants?: Restaurant[]
}