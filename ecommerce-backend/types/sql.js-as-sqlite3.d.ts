// The package ships no types; Sequelize only needs it as an opaque dialect module
declare module 'sql.js-as-sqlite3' {
  const sqlJsAsSqlite3: object;
  export default sqlJsAsSqlite3;
}
