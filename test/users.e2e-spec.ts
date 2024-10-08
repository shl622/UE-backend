import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { DataSource, Repository } from 'typeorm';
import * as request from 'supertest'
import { User } from 'src/users/entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Verification } from 'src/users/entities/verfication.entity';

/*
End-to-End testing of user.resolver
*/

//mock fetch so email is not sent on every test
jest.mock("node-fetch", () => {
  return {
    fetch: jest.fn()
  }
})

//constants
const GRAPHQL_ENDPOINT = '/graphql'
const testUser = {
  email: 'test@e2e.com',
  password: '12345'
}


describe('UserModule (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>
  let verificationRepository: Repository<Verification>
  let jwtToken: string

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    //give access to userRepository to first check the DB before test
    userRepository = module.get<Repository<User>>(getRepositoryToken(User))
    //test
    verificationRepository = module.get<Repository<Verification>>(getRepositoryToken(Verification))
    await app.init();
  });

  //for every test, drop the DB used for E2E testing
  afterAll(async () => {
    const dataSource = new DataSource({
      type: "postgres",
      host: process.env.DB_HOST,
      port: +process.env.DB_PORT,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    const connection = await dataSource.initialize();
    await connection.dropDatabase(); //delete test db
    await connection.destroy(); //disconnect
    await app.close();
    app.close()
  })

  /*
  to-do:
  <Must follow this order for E2E>
  1. test creating account
  2. test logging in
  3. test if id of any user is reached
  4. test current logged in user
  5. verify email of user
  6. check if edits user profile
  */

  describe('createAccount', () => {
    it('should create account', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .send({
          query: `
        mutation{
          createAccount(input:{
            email:"${testUser.email}",
            password:"${testUser.password}",
            role:Owner
          }) {
            ok
            error
          }
        }
        `,
        })
        .expect(200)
        .expect(res => {
          const {
            body: {
              data: { createAccount }
            }
          } = res
          expect(createAccount.ok).toBe(true)
          expect(createAccount.error).toBe(null)
        })
    })
    it('should fail if account already exists', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .send({
          query: `
        mutation{
          createAccount(input:{
            email:"${testUser.email}",
            password:"${testUser.password}",
            role:Owner
          }) {
            ok
            error
          }
        }
        `,
        })
        .expect(200)
        .expect(res => {
          const {
            body: {
              data: { createAccount }
            }
          } = res
          expect(createAccount.ok).toBe(false)
          expect(createAccount.error).toEqual(expect.any(String))
        })
    })
  })

  describe('login', () => {
    it('should receive token with correct credentials', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .send({
          query: `
        mutation{
          login(input:{
            email:"${testUser.email}",
            password:"${testUser.password}"
          }){
            ok
            error
            token
          }
        }`
        })
        .expect(200)
        .expect(res => {
          const {
            body: {
              data: { login }
            }
          } = res
          expect(login.ok).toBe(true)
          expect(login.error).toBe(null)
          expect(login.token).toEqual(expect.any(String))
          //update token to be used in userProfile,currAuth
          jwtToken = login.token
        })
    })
    it('should fail to login with an email that does not exist', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .send({
          query: `
        mutation{
          login(input:{
            email:"failtest@e2e.com",
            password:"${testUser.password}"
          }){
            ok
            error
            token
          }
        }`
        })
        .expect(200)
        .expect(res => {
          const {
            body: {
              data: { login }
            }
          } = res
          expect(login.ok).toBe(false)
          expect(login.error).toBe('User not found.')
          expect(login.token).toBe(null)
        })
    })
    it('should fail to login with an email that does not exist', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .send({
          query: `
        mutation{
          login(input:{
            email:"${testUser.email}",
            password:"1234"
          }){
            ok
            error
            token
          }
        }`
        })
        .expect(200)
        .expect(res => {
          const {
            body: {
              data: { login }
            }
          } = res
          expect(login.ok).toBe(false)
          expect(login.error).toBe("Password does not match.")
          expect(login.token).toBe(null)
        })
    })
  })

  describe('userProfile', () => {
    let userId: number

    //grab the first user in test-db
    beforeAll(async () => {
      const [user] = await userRepository.find()
      userId = user.id
    })

    it('should find a user profile', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .set("X-JWT", jwtToken)
        .send({
          query:
            `{
            userProfile(userId:${userId}){
              ok
              error
              user{
                id
              }
            }
          }`
        })
        .expect(200)
        .expect(res => {
          const {
            body: {
              data: { userProfile }
            }
          } = res
          expect(userProfile).toEqual({ ok: true, user: { id: userId }, error: null })
        })
    })
    it('should not find a profile', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .set("X-JWT", jwtToken)
        .send({
          query:
            `{
            userProfile(userId:2){
              ok
              error
              user{
                id
              }
            }
          }`
        })
        .expect(200)
        .expect(res => {
          const {
            body: {
              data: { userProfile }
            }
          } = res
          expect(userProfile).toEqual({ ok: false, user: null, error: 'User not found.' })
        })
    })
  })

  describe('currAuth', () => {
    it('should find my profile if logged in', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .set('X-JWT', jwtToken)
        .send({
          query:
            `{
          currAuth{
            email
          }
        }`
        })
        .expect(200)
        .expect(res => {
          const {
            body: {
              data: {
                currAuth: {
                  email
                }
              }
            }
          } = res
          expect(email).toBe(testUser.email)
        })
    })

    it('should fail if user is not logged in', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .send({
          query:
            `{
        currAuth{
          email
        }
      }`
        })
        .expect(200)
        .expect(res => {
          const {
            body: { error }
          } = res
          expect(error).toBe(undefined)
        })
    })
  })

  describe('editProfile', () => {
    const existEmail = "exist@test.com"
    const newPassword = "asdf1234"
    //test changing email
    it('should change the email', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .set('X-JWT', jwtToken)
        .send({
          query:
            `mutation{
            editProfile(input:{
              email:"update@test.com"
            }){
              ok
              error
            }
          }`
        })
        .expect(200)
        .expect(res => {
          const {
            body: {
              data: {
                editProfile: { ok, error }
              }
            }
          } = res
          expect(ok).toBe(true)
          expect(error).toBe(null)
        })
        //check if email is actually changed
        .then(() => {
          request(app.getHttpServer())
            .post(GRAPHQL_ENDPOINT)
            .set('X-JWT', jwtToken)
            .send({
              query:
                `{
            currAuth{
              email
            }
          }`
            })
            .expect(200)
            .expect(res => {
              const {
                body: {
                  data: {
                    currAuth: {
                      email
                    }
                  }
                }
              } = res
              expect(email).toBe(testUser.email)
            })
        })
    })

    it('should fail if updating email already exists', () => {
      //first create an account
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .send({
          query: `
        mutation{
          createAccount(input:{
            email:"${existEmail}",
            password:"${testUser.password}",
            role:Owner
          }) {
            ok
            error
          }
        }
        `,
        })
        .expect(200)
        .then(() => {
          return request(app.getHttpServer())
            .post(GRAPHQL_ENDPOINT)
            .set('X-JWT', jwtToken)
            .send({
              query:
                `mutation{
                editProfile(input:{
                  email:"${existEmail}"
                }){
                  ok
                  error
                }
              }`
            })
            .expect(200)
            .expect(res => {
              const {
                body: {
                  data: {
                    editProfile: { ok, error }
                  }
                }
              } = res
              expect(ok).toBe(false)
              expect(error).toBe("Email is already in use.")
            })
        })
    })

    it('should update password', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .set('X-JWT', jwtToken)
        .send({
          query:
            `mutation{
                editProfile(input:{
                  password: "${newPassword}"
                }){
                  ok
                  error
                }
              }`
        })
        .expect(200)
        .expect(res => {
          const {
            body: {
              data: {
                editProfile: { ok, error }
              }
            }
          } = res
          expect(ok).toBe(true)
          expect(error).toBe(null)
        })
    })
  });

  describe('verifyEmail', () => {
    let verificationCode: string
    beforeAll(async () => {
      const [verification] = await verificationRepository.find()
      verificationCode = verification.code
    })
    it('should verify email', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .send({
          query:
            `mutation{
          verifyEmail(input:{
            code:"${verificationCode}"
          }){
            ok
            error
          }
        }`
        })
        .expect(200)
        .expect(res => {
          const {
            body: {
              data: {
                verifyEmail: { ok, error }
              }
            }
          } = res
          expect(ok).toBe(true)
          expect(error).toBe(null)
        })
    })
    it('should fail on verification code not found',()=>{
      return request(app.getHttpServer())
      .post(GRAPHQL_ENDPOINT)
      .send({
        query:
          `mutation{
        verifyEmail(input:{
          code:"xxxx"
        }){
          ok
          error
        }
      }`
      })
      .expect(200)
      .expect(res => {
        const {
          body: {
            data: {
              verifyEmail: { ok, error }
            }
          }
        } = res
        expect(ok).toBe(false)
        expect(error).toBe("Verification not found.")
      })
    })
  })
});