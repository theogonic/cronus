export interface Usecase {
  name: string;
  methods: UsecaseMethod[];
}

export interface UsecaseMethod {
  name: string;

  /**
   * Referenced to a UsecaseParam
   */
  requestType: string;

  /**
   * Referenced to a UsecaseParam
   */
  responseType: string;
}

export interface UsecaseParam {
  /**
   * If name is null, means it is an interface not property
   */
  name?: string;
  /**
   * If type is null, means param is interface,
   * also infers that property children cannot be null
   */
  type?: string;

  /**
   * Only set when UsecaseParam is property
   */
  optional?: boolean;
  /**
   * Undefined If type is string, number, boolean
   * Array of UsecaseParam if type is object
   * Single element array if type is array
   */
  children?: ReadonlyArray<UsecaseParam>;
}

export interface GenerationContext {
  /**
   * Types referenced in the usecase declaration,
   * usually are mentioned in request or response
   */
  deps: UsecaseParam[];

  /**
   * All usecases parsed from the given files
   */
  usecases: Usecase[];
}
