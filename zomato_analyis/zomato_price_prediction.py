import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score


def run():

    print("Running Price Prediction Module")

    df = pd.read_csv("zomato.csv", encoding="latin1")

    df = df[['City','Cuisines','Average Cost for two',
             'Has Table booking','Has Online delivery',
             'Price range','Aggregate rating','Votes']]

    df.dropna(inplace=True)

    le = LabelEncoder()

    for col in ['City','Cuisines','Has Table booking','Has Online delivery']:
        df[col] = le.fit_transform(df[col])

    X = df.drop("Average Cost for two", axis=1)
    y = df["Average Cost for two"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # Linear Regression
    lr = LinearRegression()
    lr.fit(X_train, y_train)

    pred_lr = lr.predict(X_test)

    # Random Forest
    rf = RandomForestRegressor(n_estimators=200, random_state=42)
    rf.fit(X_train, y_train)

    pred_rf = rf.predict(X_test)

    print("LR R2:", r2_score(y_test, pred_lr))
    print("RF R2:", r2_score(y_test, pred_rf))

    # Comparison
    sns.barplot(x=["Linear","Random Forest"],
                y=[r2_score(y_test,pred_lr),
                   r2_score(y_test,pred_rf)])
    plt.title("Price Model Comparison")
    plt.show()

    print("Price Module Completed")


if __name__ == "__main__":
    run()
