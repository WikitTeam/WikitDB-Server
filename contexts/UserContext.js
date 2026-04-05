import React, { createContext, useState, useEffect, useContext } from 'react';

const UserContext = createContext();

export function UserProvider({ children }) {
    const [username, setUsername] = useState(null);
    const [balance, setBalance] = useState(0);

    useEffect(() => {
        const storedUser = localStorage.getItem('username');
        if (storedUser) {
            setUsername(storedUser);
            refreshBalance(storedUser);
        }
    }, []);

    const refreshBalance = async (uname) => {
        const target = uname || username;
        if (!target) return;
        try {
            const res = await fetch(`/api/admin/user-assets?username=${target}`);
            if (res.ok) {
                const data = await res.json();
                if (data.portfolio) setBalance(data.portfolio.balance || 0);
            }
        } catch (e) {
            console.error('Failed to fetch balance');
        }
    };

    const login = (uname) => {
        localStorage.setItem('username', uname);
        setUsername(uname);
        refreshBalance(uname);
    };

    const logout = async () => {
        localStorage.removeItem('username');
        setUsername(null);
        setBalance(0);
        await fetch('/api/logout', { method: 'POST' });
        window.location.reload();
    };

    return (
        <UserContext.Provider value={{ username, balance, refreshBalance, login, logout }}>
            {children}
        </UserContext.Provider>
    );
}

export const useUser = () => useContext(UserContext);
