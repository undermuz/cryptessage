import { injectable } from "inversify";
import { IMyProvider } from "./types";

@injectable()
export class MyClass implements IMyProvider {}
