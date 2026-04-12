def test_register_success(client):
    res = client.post("/auth/register", json={
        "name": "Alice", "email": "alice@example.com", "password": "password123",
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "alice@example.com"


def test_register_duplicate_email(client):
    payload = {"name": "Alice", "email": "alice@example.com", "password": "password123"}
    client.post("/auth/register", json=payload)
    res = client.post("/auth/register", json=payload)
    assert res.status_code == 400


def test_register_short_password(client):
    res = client.post("/auth/register", json={
        "name": "Alice", "email": "alice@example.com", "password": "short",
    })
    assert res.status_code == 422


def test_register_invalid_email(client):
    res = client.post("/auth/register", json={
        "name": "Alice", "email": "not-an-email", "password": "password123",
    })
    assert res.status_code == 422


def test_login_success(client):
    client.post("/auth/register", json={
        "name": "Alice", "email": "alice@example.com", "password": "password123",
    })
    res = client.post("/auth/login", json={
        "email": "alice@example.com", "password": "password123",
    })
    assert res.status_code == 200
    assert "access_token" in res.json()


def test_login_wrong_password(client):
    client.post("/auth/register", json={
        "name": "Alice", "email": "alice@example.com", "password": "password123",
    })
    res = client.post("/auth/login", json={
        "email": "alice@example.com", "password": "wrongpassword",
    })
    assert res.status_code == 401


def test_login_nonexistent_email(client):
    res = client.post("/auth/login", json={
        "email": "nobody@example.com", "password": "password123",
    })
    assert res.status_code == 401


def test_get_me_authenticated(client, auth_headers):
    res = client.get("/auth/me", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["email"] == "test@example.com"


def test_get_me_no_token(client):
    res = client.get("/auth/me")
    assert res.status_code == 401


def test_get_me_invalid_token(client):
    res = client.get("/auth/me", headers={"Authorization": "Bearer invalid.token.here"})
    assert res.status_code == 401


def test_update_me(client, auth_headers):
    res = client.patch("/auth/me", json={"name": "Updated Name"}, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["name"] == "Updated Name"
