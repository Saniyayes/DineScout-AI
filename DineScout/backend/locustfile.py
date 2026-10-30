
from locust import HttpUser, task, between


class DineScoutUser(HttpUser):
    wait_time = between(1, 3)

    @task
    def dish_recommendations(self):
        with self.client.get(
            "/api/restaurants/dishes/recommendations",
            name="Dish Recommendations",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(
                    f"HTTP {response.status_code}"
                )
