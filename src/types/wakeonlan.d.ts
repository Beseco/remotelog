declare module "wakeonlan" {
  function wake(mac: string, options?: { address?: string; port?: number }): Promise<void>;
  export = wake;
}
