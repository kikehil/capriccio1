const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

const dbPromise = open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver: sqlite3.Database
});

dbPromise.then(db => {
    // Activar claves foráneas en SQLite
    db.run('PRAGMA foreign_keys = ON');
    console.log('✅ Conectado a SQLite Local (database.sqlite)');
}).catch(err => {
    console.error('❌ Error in SQLite client', err);
});

module.exports = {
    query: async (text, params = []) => {
        const db = await dbPromise;
        let sqliteText = text;

        // 1. Convertir $1, $2, $3 a ?
        sqliteText = sqliteText.replace(/\$\d+/g, '?');

        // 2. Booleanos true/false a 1/0
        sqliteText = sqliteText.replace(/activo = true/g, 'activo = 1');
        sqliteText = sqliteText.replace(/activo = false/g, 'activo = 0');
        sqliteText = sqliteText.replace(/liquidado = false/g, 'liquidado = 0');
        sqliteText = sqliteText.replace(/liquidado = true/g, 'liquidado = 1');

        // 3. Fechas
        sqliteText = sqliteText.replace(/CURRENT_TIMESTAMP/g, "(datetime('now', 'localtime'))");
        // Si hay una comparación tipo Date(created_at) >= $1 en Postgres... la adaptamos:
        sqliteText = sqliteText.replace(/Date\(created_at\)/g, "date(created_at)");

        const isSelect = sqliteText.trim().toUpperCase().startsWith('SELECT') || sqliteText.toUpperCase().includes('RETURNING');

        try {
            if (isSelect) {
                const rows = await db.all(sqliteText, params);
                // Si la consulta fue RETURNING *
                return { rows, rowCount: rows.length };
            } else {
                const result = await db.run(sqliteText, params);
                return { rows: [], rowCount: result.changes, lastID: result.lastID };
            }
        } catch (e) {
            console.error("SQLITE ERROR:", e.message, "\nQUERY:", sqliteText);
            throw e;
        }
    },
    getTransaction: async () => {
        const db = await dbPromise;
        // SQLite lock per file instead of concurrent transactions, but we mimic the behavior
        await db.run('BEGIN TRANSACTION');
        return {
            client: {
                query: async (text, params = []) => {
                    let sqliteText = text.replace(/\$\d+/g, '?');
                    sqliteText = sqliteText.replace(/activo = true/g, 'activo = 1');
                    sqliteText = sqliteText.replace(/activo = false/g, 'activo = 0');
                    const isSelect = sqliteText.trim().toUpperCase().startsWith('SELECT') || sqliteText.toUpperCase().includes('RETURNING');
                    if (isSelect) {
                        const rows = await db.all(sqliteText, params);
                        return { rows, rowCount: rows.length };
                    } else {
                        const result = await db.run(sqliteText, params);
                        // Mimic returning id:
                        if (sqliteText.toUpperCase().includes("RETURNING ID")) {
                           return { rows: [{ id: result.lastID }] };
                        }
                        return { rows: [], rowCount: result.changes, lastID: result.lastID };
                    }
                }
            },
            release: () => {},
            begin: async () => {}, // ya hecho arriba
            commit: async () => await db.run('COMMIT'),
            rollback: async () => await db.run('ROLLBACK')
        };
    },
    dbPromise
};
