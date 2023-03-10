/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import type { Provider } from "@ethersproject/providers";
import type {
  DefaultOperatorFilterer,
  DefaultOperatorFiltererInterface,
} from "../../../operator-filter-registry/src/DefaultOperatorFilterer";

const _abi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "operator",
        type: "address",
      },
    ],
    name: "OperatorNotAllowed",
    type: "error",
  },
  {
    inputs: [],
    name: "OPERATOR_FILTER_REGISTRY",
    outputs: [
      {
        internalType: "contract IOperatorFilterRegistry",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export class DefaultOperatorFilterer__factory {
  static readonly abi = _abi;
  static createInterface(): DefaultOperatorFiltererInterface {
    return new utils.Interface(_abi) as DefaultOperatorFiltererInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): DefaultOperatorFilterer {
    return new Contract(
      address,
      _abi,
      signerOrProvider
    ) as DefaultOperatorFilterer;
  }
}
