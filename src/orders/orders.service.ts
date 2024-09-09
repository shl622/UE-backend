import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Order } from "./entities/order.entity";
import { Repository } from "typeorm";
import { Resolver } from "@nestjs/graphql";
import { CreateOrderInput, CreateOrderOutput } from "./dto/create-order.dto";
import { User } from "src/users/entities/user.entity";
import { Restaurant } from "src/restaurants/entities/restaurant.entity";
import { OrderItem } from "./entities/order-item.entity";
import { Dish, DishOption } from "src/restaurants/entities/dish.entity";


@Injectable()
export class OrderService {
    constructor(
        @InjectRepository(Order) private readonly orders: Repository<Order>,
        @InjectRepository(OrderItem) private readonly orderItems: Repository<OrderItem>,
        @InjectRepository(Dish) private readonly dishes: Repository<Dish>,
        @InjectRepository(Restaurant) private readonly restaurants: Repository<Restaurant>
    ) { }

    //first create the order and add items to the order
    async createOrder(customer: User, { restaurantId, items }: CreateOrderInput): Promise<CreateOrderOutput> {
        try {
            const restaurant = await this.restaurants.findOne({ where: { id: restaurantId } })
            if (!restaurant) {
                return {
                    ok: false,
                    error: 'Failed to find restaurant.'
                }
            }
            let orderFinalPrice = 0
            const orderItems: OrderItem[] = []
            for (const item of items) {
                const dish = await this.dishes.findOne({ where: { id: item.dishId } })
                if (!dish) {
                    return {
                        ok: false,
                        error: 'Failed to find the menu item.'
                    }
                }
                let dishFinalPrice = dish.price
                //for each option sent from user(frontend), validate with data in DB
                //Runtime complexity trade-off here: using hashmap vs not having a separate entity for options
                //opted with not having another entity as I expect the extras to be small so O(n^2) can be acceptable
                for (const itemOption of item.options) {
                    const dishOption = dish.options.find(dishOption => dishOption.name === itemOption.name)
                    if (dishOption) {
                        if (dishOption.extra) {
                            dishFinalPrice = dishFinalPrice + dishOption.extra
                            // console.log(`USD + ${dishOption.extra}`)
                        } else {
                            const dishOptionChoice = dishOption.choices.find(optionChoice => optionChoice.name === itemOption.choice)
                            if (dishOptionChoice.extra) {
                                // console.log(`USD + ${dishOptionChoice.extra}`)
                                dishFinalPrice = dishFinalPrice + dishOptionChoice.extra
                            }
                        }
                    }
                }
                orderFinalPrice = dishFinalPrice + orderFinalPrice
                const orderItem = await this.orderItems.save(this.orderItems.create({
                    dish,
                    options: item.options
                }))
                orderItems.push(orderItem)
            }

            await this.orders.save(this.orders.create({
                customer,
                restaurant,
                total: orderFinalPrice,
                items: orderItems
            }))
            return {
                ok: true
            }
        } catch {
            return {
                ok: false,
                error: 'Failed to create order.'
            }
        }
    }
}