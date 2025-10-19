from flask import Flask, request, jsonify
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import pandas as pd
import numpy as np

app = Flask(__name__)

@app.route('/recommend', methods=['POST'])
def recommend():
    try:
        data = request.get_json()
        
        # Product page recommendation
        if "target_product_id" in data:
            products = pd.DataFrame(data["products"])
            target_id = data["target_product_id"]

            if products.empty or target_id not in products["_id"].values:
                return jsonify({"recommendations": []})

            # Combine text fields for vectorization
            products["combined"] = (
                products["name"].fillna('') + ' ' +
                products["description"].fillna('') + ' ' +
                products["category"].astype(str).fillna('') + ' ' +
                products["tags"].apply(lambda x: ' '.join(x) if isinstance(x, list) else '')
            )

            tfidf = TfidfVectorizer(stop_words='english')
            matrix = tfidf.fit_transform(products["combined"])

            idx = products.index[products["_id"] == target_id][0]
            sim_scores = list(enumerate(cosine_similarity(matrix[idx], matrix).flatten()))

            sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)[1:7]
            recommendations = products.iloc[[i[0] for i in sim_scores]]["_id"].tolist()
            return jsonify({"recommendations": recommendations})

        # Home page recommendation
        elif "user_profile" in data:
            profile = data.get("user_profile", [])

            products = pd.DataFrame(profile)
            if products.empty:
                return jsonify({"recommendations": []})

            products["combined"] = (
                products["title"].fillna('') + ' ' +
                products["description"].fillna('') + ' ' +
                products["category"].astype(str).fillna('') + ' ' +
                products["tags"].apply(lambda x: ' '.join(x) if isinstance(x, list) else '')
            )

            tfidf = TfidfVectorizer(stop_words='english')
            matrix = tfidf.fit_transform(products["combined"])

            avg_vector = matrix.mean(axis=0)
            avg_vector = np.asarray(avg_vector)
            sim_scores = cosine_similarity(avg_vector, matrix).flatten()
            top_indices = sim_scores.argsort()[-6:][::-1]

            recommendations = products.iloc[top_indices]["_id"].tolist()
            return jsonify({"recommendations": recommendations})

        else:
            return jsonify({"recommendations": []})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5001)
