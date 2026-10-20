import pandas as pd
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
from scipy.cluster.hierarchy import linkage, dendrogram, fcluster, cophenet
from scipy.spatial.distance import pdist


def run():

    print("Running Cuisine Trend & Clustering Module")

    df = pd.read_csv("zomato.csv", encoding="latin1")
    df = df[["City", "Cuisines", "Aggregate rating", "Votes"]]

    df = df.dropna()

    df["City"] = df["City"].str.lower().str.strip()
    df["Cuisines"] = df["Cuisines"].str.lower().str.strip()

    df["Cuisines"] = df["Cuisines"].str.split(",")
    df = df.explode("Cuisines")
    df["Cuisines"] = df["Cuisines"].str.strip()

    # Trend Analysis
    cuisine_counts = df["Cuisines"].value_counts().head(10)

    plt.figure(figsize=(10, 5))
    cuisine_counts.plot(kind="bar")
    plt.title("Top 10 Trending Cuisines")
    plt.tight_layout()
    plt.show()

    # Clustering
    city_matrix = pd.crosstab(df["City"], df["Cuisines"])

    scaler = StandardScaler()
    scaled = scaler.fit_transform(city_matrix)

    kmeans = KMeans(n_clusters=4, random_state=42)
    clusters = kmeans.fit_predict(scaled)

    city_matrix["Cluster"] = clusters

    city_matrix[["Cluster"]].to_csv("city_clusters.csv")

    # PCA
    pca = PCA(n_components=2)
    data_2d = pca.fit_transform(scaled)

    plt.figure()
    plt.scatter(data_2d[:, 0], data_2d[:, 1], c=clusters)
    plt.title("City Clusters (PCA)")
    plt.show()

    # Silhouette
    scores = []

    for k in [2, 3, 4, 5, 6]:
        km = KMeans(n_clusters=k, random_state=42)
        labels = km.fit_predict(scaled)
        scores.append(silhouette_score(scaled, labels))

    plt.figure()
    plt.plot([2,3,4,5,6], scores, marker='o')
    plt.title("Silhouette Scores")
    plt.show()

    print("Clustering Module Completed")


if __name__ == "__main__":
    run()
