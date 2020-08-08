export default class ForienError extends Error {
  constructor(error) {
    error = `Welcome Screen | ${error}`;
    super(error);
  }
}