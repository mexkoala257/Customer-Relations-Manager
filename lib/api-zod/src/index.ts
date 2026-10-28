export * from "./generated/api";
export * from "./generated/types";
// Prefer the runtime validators when request interfaces share their names.
export {
  CreateCustomerBody,
  CreateLeadBody,
  CreateUserBody,
  LoginBody,
  UpdateCustomerBody,
  UpdateLeadBody,
  UpdateUserBody,
} from "./generated/api";
