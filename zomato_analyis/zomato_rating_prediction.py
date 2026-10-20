import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix


def run():

    print("Running Rating Prediction Module")

    df = pd.read_csv("zomato.csv", encoding="latin1")

    df = df[['Average Cost for two','Votes',
             'Has Online delivery','Has Table booking',
             'City','Cuisines','Aggregate rating']]

    df.dropna(inplace=True)

    def rate_cat(r):
        if r < 2.5: return 0
        elif r < 3.5: return 1
        elif r < 4.2: return 2
        else: return 3

    df["Rating_Category"] = df["Aggregate rating"].apply(rate_cat)

    le = LabelEncoder()

    for col in ['Has Online delivery','Has Table booking','City','Cuisines']:
        df[col] = le.fit_transform(df[col])

    X = df.drop(['Aggregate rating','Rating_Category'], axis=1)
    y = df['Rating_Category']

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test = scaler.transform(X_test)

    # Logistic
    lr = LogisticRegression(max_iter=1000)
    lr.fit(X_train, y_train)

    pred_lr = lr.predict(X_test)

    # RF
    rf = RandomForestClassifier(n_estimators=200, random_state=42)
    rf.fit(X_train, y_train)

    pred_rf = rf.predict(X_test)

    print("Logistic Accuracy:", accuracy_score(y_test,pred_lr))
    print("RF Accuracy:", accuracy_score(y_test,pred_rf))

    sns.heatmap(confusion_matrix(y_test,pred_rf), annot=True)
    plt.title("RF Confusion Matrix")
    plt.show()

    print("Rating Module Completed")


if __name__ == "__main__":
    run()
